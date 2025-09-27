import java.io.*;
import java.net.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;

/**
 * 간단한 HTTP 서버로 Race Condition 데모 제공
 * 브라우저에서 접근 가능한 REST API 구현
 */
public class RaceConditionWebServer {
    
    private static volatile int availableCoupons = 2;
    private static final AtomicInteger atomicCoupons = new AtomicInteger(2);
    private static final ReentrantLock pessimisticLock = new ReentrantLock();
    private static final AtomicInteger version = new AtomicInteger(0);
    private static final List<ParticipantResult> lastResults = Collections.synchronizedList(new ArrayList<>());
    private static final List<String> logs = Collections.synchronizedList(new ArrayList<>());
    
    // 참가자 결과 클래스
    static class ParticipantResult {
        public int participantId;
        public boolean success;
        public String message;
        public String threadName;
        public long timestamp;
        
        public ParticipantResult(int participantId, boolean success, String message) {
            this.participantId = participantId;
            this.success = success;
            this.message = message;
            this.threadName = Thread.currentThread().getName();
            this.timestamp = System.currentTimeMillis();
        }
    }
    
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(8080);
        System.out.println("🚀 Race Condition 웹 서버가 시작되었습니다!");
        System.out.println("🌐 브라우저에서 http://localhost:8080 접속하세요");
        System.out.println("📋 API 엔드포인트:");
        System.out.println("   - GET  /           : 웹 페이지");
        System.out.println("   - POST /api/race   : Race Condition 실행");
        System.out.println("   - POST /api/pessimistic : 비관적 락 실행");
        System.out.println("   - POST /api/optimistic  : 낙관적 락 실행");
        System.out.println();
        
        while (true) {
            Socket clientSocket = serverSocket.accept();
            new Thread(() -> handleRequest(clientSocket)).start();
        }
    }
    
    private static void handleRequest(Socket clientSocket) {
        try {
            BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true);
            
            String requestLine = in.readLine();
            System.out.println("📡 " + requestLine);
            
            // HTTP 헤더 읽기
            String line;
            while ((line = in.readLine()) != null && !line.isEmpty()) {
                // 헤더 처리 (생략)
            }
            
            if (requestLine == null) {
                return;
            }
            
            String[] parts = requestLine.split(" ");
            String method = parts[0];
            String path = parts[1];
            
            // CORS 헤더 추가
            String response = "HTTP/1.1 200 OK\r\n";
            response += "Access-Control-Allow-Origin: *\r\n";
            response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
            response += "Access-Control-Allow-Headers: Content-Type\r\n";
            response += "Content-Type: ";
            
            if ("OPTIONS".equals(method)) {
                response += "text/plain\r\n\r\n";
            } else if ("GET".equals(method) && "/".equals(path)) {
                response += "text/html; charset=UTF-8\r\n\r\n";
                response += getWebPage();
            } else if (("POST".equals(method) || "GET".equals(method)) && path.startsWith("/api/")) {
                response += "application/json; charset=UTF-8\r\n\r\n";
                response += handleApiRequest(path);
            } else {
                response = "HTTP/1.1 404 Not Found\r\n\r\n404 Not Found";
            }
            
            out.print(response);
            out.flush();
            
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            try {
                clientSocket.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }
    
    private static String handleApiRequest(String path) {
        try {
            // 요청 디버깅 로그 추가
            String timestamp = java.time.LocalDateTime.now().toString();
            addLog(String.format("🌐 [API] 요청 수신: %s (시간: %s)", path, timestamp));

            resetCoupons();

            if ("/api/race".equals(path)) {
                addLog("🏁 [API] Race Condition 시뮬레이션 요청");
                List<ParticipantResult> results = runRaceCondition();
                String response = createJsonResponse("race", results);
                addLog(String.format("📤 [API] Race 응답: 승자 %d명, 쿠폰 %d개 남음", countWinners(results), atomicCoupons.get()));
                return response;
            } else if ("/api/pessimistic".equals(path)) {
                addLog("🔒 [API] Pessimistic Lock 시뮬레이션 요청");
                List<ParticipantResult> results = runPessimisticLock();
                String response = createJsonResponse("pessimistic", results);
                addLog(String.format("📤 [API] Pessimistic 응답: 승자 %d명, 쿠폰 %d개 남음", countWinners(results), atomicCoupons.get()));
                return response;
            } else if ("/api/optimistic".equals(path)) {
                addLog("🔄 [API] Optimistic Lock 시뮬레이션 요청");
                List<ParticipantResult> results = runOptimisticLock();
                String response = createJsonResponse("optimistic", results);
                addLog(String.format("📤 [API] Optimistic 응답: 승자 %d명, 쿠폰 %d개 남음", countWinners(results), atomicCoupons.get()));
                return response;
            } else if ("/api/logs".equals(path)) {
                String response = getLogsJson();
                System.out.println("📋 [API] 로그 조회 요청 - " + logs.size() + "개 로그 반환");
                return response;
            } else if ("/api/logs/clear".equals(path)) {
                clearLogs();
                return "{\"message\": \"로그가 클리어되었습니다\", \"status\": \"success\"}";
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "{\"error\": \"시뮬레이션이 중단되었습니다\"}";
        }
        
        return "{\"error\": \"알 수 없는 엔드포인트\"}";
    }
    
    private static String createJsonResponse(String type, List<ParticipantResult> results) {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"type\": \"").append(type).append("\",");
        json.append("\"finalCouponCount\": ").append(atomicCoupons.get()).append(",");
        json.append("\"message\": \"").append(type).append(" 시뮬레이션 완료\",");
        
        // winners 배열
        json.append("\"winners\": [");
        boolean first = true;
        for (ParticipantResult result : results) {
            if (result.success) {
                if (!first) json.append(",");
                json.append(result.participantId);
                first = false;
            }
        }
        json.append("],");
        
        // results 배열
        json.append("\"results\": [");
        for (int i = 0; i < results.size(); i++) {
            ParticipantResult result = results.get(i);
            if (i > 0) json.append(",");
            json.append("{");
            json.append("\"participantId\": ").append(result.participantId).append(",");
            json.append("\"success\": ").append(result.success).append(",");
            json.append("\"message\": \"").append(result.message).append("\",");
            json.append("\"threadName\": \"").append(result.threadName).append("\",");
            json.append("\"timestamp\": ").append(result.timestamp);
            json.append("}");
        }
        json.append("]");
        json.append("}");
        
        return json.toString();
    }
    
    private static void resetCoupons() {
        availableCoupons = 2;
        atomicCoupons.set(2);
        lastResults.clear();
        // Don't clear logs - keep them for real-time display
        version.set(0);
    }

    private static void addLog(String message) {
        logs.add(message);
        System.out.println(message);
    }

    private static void clearLogs() {
        logs.clear();
        System.out.println("🧹 로그가 클리어되었습니다");
    }

    private static int countWinners(List<ParticipantResult> results) {
        int count = 0;
        for (ParticipantResult result : results) {
            if (result.success) {
                count++;
            }
        }
        return count;
    }
    
    // Race Condition 실행
    private static List<ParticipantResult> runRaceCondition() throws InterruptedException {
        addLog("⚡ Race Condition 시뮬레이션 시작");
        return runConcurrentTest("Race", () -> tryGetCouponRace());
    }
    
    // 비관적 락 실행
    private static List<ParticipantResult> runPessimisticLock() throws InterruptedException {
        addLog("🔒 비관적 락 시뮬레이션 시작");
        return runConcurrentTest("Pessimistic", () -> tryGetCouponPessimistic());
    }
    
    // 낙관적 락 실행
    private static List<ParticipantResult> runOptimisticLock() throws InterruptedException {
        addLog("🔄 낙관적 락 시뮬레이션 시작");
        return runConcurrentTest("Optimistic", () -> tryGetCouponOptimistic());
    }
    
    private static List<ParticipantResult> runConcurrentTest(String testName, Runnable couponMethod) throws InterruptedException {
        List<ParticipantResult> results = Collections.synchronizedList(new ArrayList<>());
        ExecutorService executor = Executors.newFixedThreadPool(5);
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(5);
        
        // 5개 스레드 준비
        for (int i = 1; i <= 5; i++) {
            final int participantId = i;
            executor.submit(() -> {
                try {
                    startSignal.await();
                    
                    addLog(String.format("[%s] 참가자 %d (스레드: %s) - 시작",
                                    testName, participantId, Thread.currentThread().getName()));
                    
                    // 참가자 ID를 스레드 로컬에 저장
                    ThreadLocal<Integer> threadLocal = new ThreadLocal<>();
                    threadLocal.set(participantId);
                    
                    couponMethod.run();
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneSignal.countDown();
                }
            });
        }
        
        Thread.sleep(100);
        addLog("🚀 모든 스레드 동시 시작!");
        startSignal.countDown();

        // 타임아웃을 포함한 대기 (최대 10초)
        boolean allThreadsCompleted = doneSignal.await(10, TimeUnit.SECONDS);
        if (!allThreadsCompleted) {
            addLog("⚠️ 일부 스레드가 타임아웃으로 완료되지 않았습니다");
        } else {
            addLog("✅ 모든 스레드가 완료되었습니다");
        }

        executor.shutdown();
        if (!executor.awaitTermination(2, TimeUnit.SECONDS)) {
            addLog("⚠️ 실행자 서비스 강제 종료");
            executor.shutdownNow();
        }

        addLog(String.format("📊 [%s] 시뮬레이션 완료 - 결과: %d명 참여, %d명 승리, 쿠폰 %d개 남음",
               testName, lastResults.size(), countWinners(lastResults), atomicCoupons.get()));

        return new ArrayList<>(lastResults);
    }
    
    private static void tryGetCouponRace() {
        int participantId = getCurrentParticipantId();
        
        if (availableCoupons > 0) {
            int currentCoupons = availableCoupons;
            
            try {
                Thread.sleep(100 + (int)(Math.random() * 100));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            
            if (currentCoupons > 0) {
                availableCoupons--;
                String message = "쿠폰 획득! (남은 쿠폰: " + availableCoupons + ")";
                if (availableCoupons < 0) {
                    message += " - 심각한 문제 발생!";
                }
                lastResults.add(new ParticipantResult(participantId, true, message));
                addLog(String.format("🎯 [Race] 참가자 %d - %s", participantId, message));
            }
        } else {
            lastResults.add(new ParticipantResult(participantId, false, "쿠폰 없음"));
        }
    }
    
    private static void tryGetCouponPessimistic() {
        int participantId = getCurrentParticipantId();
        
        pessimisticLock.lock();
        try {
            addLog(String.format("🔓 [Pessimistic] 참가자 %d - 락 획득", participantId));
            
            if (availableCoupons > 0) {
                Thread.sleep(150);
                availableCoupons--;
                String message = "쿠폰 획득! (남은 쿠폰: " + availableCoupons + ")";
                lastResults.add(new ParticipantResult(participantId, true, message));
                addLog(String.format("🎯 [Pessimistic] 참가자 %d - %s", participantId, message));
            } else {
                lastResults.add(new ParticipantResult(participantId, false, "쿠폰 없음"));
                addLog(String.format("❌ [Pessimistic] 참가자 %d - 쿠폰 없음", participantId));
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            pessimisticLock.unlock();
            addLog(String.format("🔓 [Pessimistic] 참가자 %d - 락 해제", participantId));
        }
    }
    
    private static void tryGetCouponOptimistic() {
        int participantId = getCurrentParticipantId();
        int attempt = 0;
        long startTime = System.currentTimeMillis();

        addLog(String.format("🎯 [Optimistic] 참가자 %d - 시작", participantId));

        while (true) {
            attempt++;

            // 쿠폰 상태 확인
            int currentCoupons = atomicCoupons.get();
            if (currentCoupons <= 0) {
                addLog(String.format("❌ [Optimistic] 참가자 %d - 쿠폰 소진 (시도: %d회)", participantId, attempt));
                lastResults.add(new ParticipantResult(participantId, false, "쿠폰 소진 (시도: " + attempt + "회)"));
                return;
            }

            // 타임아웃 체크 (최대 5초)
            if (System.currentTimeMillis() - startTime > 5000) {
                addLog(String.format("⏰ [Optimistic] 참가자 %d - 타임아웃 (시도: %d회)", participantId, attempt));
                lastResults.add(new ParticipantResult(participantId, false, "타임아웃 (시도: " + attempt + "회)"));
                return;
            }

            // 순수 낙관적 락: 직접 쿠폰을 compareAndSet으로 원자적 차감 (버전 체크 없음!)
            if (atomicCoupons.compareAndSet(currentCoupons, currentCoupons - 1)) {
                String message = "쿠폰 획득! (시도: " + attempt + "회, 남은 쿠폰: " + (currentCoupons - 1) + ")";
                addLog(String.format("✅ [Optimistic] 참가자 %d - %s", participantId, message));
                lastResults.add(new ParticipantResult(participantId, true, message));
                return;
            }

            // CAS 실패 시 백오프 및 재시도 로그
            addLog(String.format("⚠️ [Optimistic] 참가자 %d - CAS 실패, 재시도 %d회차 (현재 쿠폰: %d)",
                    participantId, attempt, atomicCoupons.get()));

            // 지수 백오프: 충돌이 많을수록 더 오래 대기
            try {
                int backoffTime = Math.min(5 + (int)(Math.random() * 20 * Math.pow(1.5, attempt)), 200);
                Thread.sleep(backoffTime);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                addLog(String.format("🔌 [Optimistic] 참가자 %d - 인터럽트됨", participantId));
                return;
            }
        }
    }
    
    private static int getCurrentParticipantId() {
        String threadName = Thread.currentThread().getName();
        if (threadName.contains("pool-") && threadName.contains("thread-")) {
            String[] parts = threadName.split("-");
            return Integer.parseInt(parts[parts.length - 1]);
        }
        return threadName.hashCode() % 5 + 1;
    }
    
    private static String getWebPage() {
        return "<!DOCTYPE html>" +
               "<html lang='ko'>" +
               "<head>" +
               "<meta charset='UTF-8'>" +
               "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
               "<title>Java 멀티스레드 Race Condition 데모</title>" +
               "<style>" +
               "body { font-family: Arial; margin: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; }" +
               ".container { max-width: 800px; margin: 0 auto; text-align: center; }" +
               "h1 { font-size: 2.5em; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }" +
               ".info { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; backdrop-filter: blur(10px); }" +
               ".buttons { display: flex; gap: 15px; justify-content: center; margin: 30px 0; flex-wrap: wrap; }" +
               ".btn { padding: 15px 25px; font-size: 1.1em; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold; transition: all 0.3s ease; }" +
               ".btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }" +
               ".btn:disabled { opacity: 0.6; cursor: not-allowed; }" +
               ".race-btn { background: linear-gradient(45deg, #ff6b6b, #ee5a24); }" +
               ".pessimistic-btn { background: linear-gradient(45deg, #4CAF50, #45a049); }" +
               ".optimistic-btn { background: linear-gradient(45deg, #2196F3, #1976D2); }" +
               ".results { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin-top: 20px; backdrop-filter: blur(10px); display: none; }" +
               ".participant { display: inline-block; margin: 10px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px; min-width: 120px; }" +
               ".winner { background: rgba(40,167,69,0.4); border: 2px solid #28a745; }" +
               ".loser { background: rgba(220,53,69,0.3); }" +
               ".logs-container { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin-top: 20px; backdrop-filter: blur(10px); max-height: 400px; overflow-y: auto; }" +
               ".log-entry { margin: 3px 0; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: monospace; font-size: 14px; line-height: 1.4; }" +
               ".logs-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }" +
               ".clear-logs-btn { background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }" +
               ".clear-logs-btn:hover { background: #c0392b; }" +
               "</style>" +
               "</head>" +
               "<body>" +
               "<div class='container'>" +
               "<h1>🎯 Java 멀티스레드 Race Condition</h1>" +
               "<div class='info'>" +
               "<h3>🚀 실제 Java 멀티스레드 환경</h3>" +
               "<p>5개의 실제 Java 스레드가 동시에 2개 쿠폰을 놓고 경쟁합니다!</p>" +
               "<p>서버 콘솔에서 실시간 스레드 로그를 확인할 수 있습니다.</p>" +
               "</div>" +
               "<div class='buttons'>" +
               "<button class='btn race-btn' onclick='runTest(\"race\")'>⚡ Race Condition</button>" +
               "<button class='btn pessimistic-btn' onclick='runTest(\"pessimistic\")'>🔒 비관적 락</button>" +
               "<button class='btn optimistic-btn' onclick='runTest(\"optimistic\")'>🔄 낙관적 락</button>" +
               "</div>" +
               "<div id='participants'>" +
               "<div class='participant' id='p1'>참가자 1<br><span id='s1'>대기중</span></div>" +
               "<div class='participant' id='p2'>참가자 2<br><span id='s2'>대기중</span></div>" +
               "<div class='participant' id='p3'>참가자 3<br><span id='s3'>대기중</span></div>" +
               "<div class='participant' id='p4'>참가자 4<br><span id='s4'>대기중</span></div>" +
               "<div class='participant' id='p5'>참가자 5<br><span id='s5'>대기중</span></div>" +
               "</div>" +
               "<div class='logs-container'>" +
               "<div class='logs-header'>" +
               "<h3>🔍 실시간 처리 로그</h3>" +
               "<button class='clear-logs-btn' onclick='clearLogs()'>로그 지우기</button>" +
               "</div>" +
               "<div id='logs'></div>" +
               "</div>" +
               "<div class='results' id='results'></div>" +
               "</div>" +
               "<script>" +
               "let isRunning = false; " +
               "let logPollingInterval; " +
               "async function runTest(type) { " +
               "  if (isRunning) return; " +
               "  isRunning = true; " +
               "   " +
               "  for (let i = 1; i <= 5; i++) { " +
               "    document.getElementById('p' + i).className = 'participant'; " +
               "    document.getElementById('s' + i).textContent = '처리중...'; " +
               "  } " +
               "  document.getElementById('results').style.display = 'none'; " +
               "  document.getElementById('logs').innerHTML = ''; " +
               "   " +
               "  startLogPolling(); " +
               "   " +
               "  try { " +
               "    console.log('Calling API: /api/' + type); " +
               "    const response = await fetch('/api/' + type, {  " +
               "      method: 'GET', " +
               "      headers: { 'Content-Type': 'application/json' } " +
               "    }); " +
               "    console.log('Response status:', response.status); " +
               "    if (!response.ok) throw new Error('응답 오류: ' + response.status); " +
               "    const data = await response.json(); " +
               "    console.log('Response data:', data); " +
               "     " +
               "    data.results.forEach(result => { " +
               "      const participant = document.getElementById('p' + result.participantId); " +
               "      const status = document.getElementById('s' + result.participantId); " +
               "      if (result.success) { " +
               "        participant.className = 'participant winner'; " +
               "        status.textContent = '🎉 당첨!'; " +
               "      } else { " +
               "        participant.className = 'participant loser'; " +
               "        status.textContent = '😢 실패'; " +
               "      } " +
               "    }); " +
               "     " +
               "    let resultHtml = '<h3>' + getTypeName(type) + ' 결과</h3>'; " +
               "    resultHtml += '<p>🏆 당첨자: ' + (data.winners.length > 0 ? '참가자 ' + data.winners.join(', 참가자 ') : '없음') + '</p>'; " +
               "    resultHtml += '<p>남은 쿠폰: ' + data.finalCouponCount + '개</p>'; " +
               "     " +
               "    if (type === 'race' && data.winners.length > 2) { " +
               "      resultHtml += '<div style=\"background: rgba(255,0,0,0.3); padding: 15px; border-radius: 8px; margin-top: 15px;\">'; " +
               "      resultHtml += '💀 <strong>Race Condition 발생!</strong><br>'; " +
               "      resultHtml += '쿠폰 2개에 ' + data.winners.length + '명이 당첨되었습니다!'; " +
               "      resultHtml += '</div>'; " +
               "    } " +
               "     " +
               "    document.getElementById('results').innerHTML = resultHtml; " +
               "    document.getElementById('results').style.display = 'block'; " +
               "     " +
               "  } catch (error) { " +
               "    alert('서버 오류: ' + error.message); " +
               "  } finally { " +
               "    setTimeout(() => stopLogPolling(), 2000); " +
               "    isRunning = false; " +
               "  } " +
               "} " +
               " " +
               "function getTypeName(type) { " +
               "  switch(type) { " +
               "    case 'race': return '⚡ Race Condition'; " +
               "    case 'pessimistic': return '🔒 비관적 락'; " +
               "    case 'optimistic': return '🔄 낙관적 락'; " +
               "    default: return type; " +
               "  } " +
               "} " +
               " " +
               "function startLogPolling() { " +
               "  if (logPollingInterval) clearInterval(logPollingInterval); " +
               "  logPollingInterval = setInterval(fetchLogs, 200); " +
               "} " +
               " " +
               "function stopLogPolling() { " +
               "  if (logPollingInterval) { " +
               "    clearInterval(logPollingInterval); " +
               "    logPollingInterval = null; " +
               "  } " +
               "} " +
               " " +
               "function fetchLogs() { " +
               "  fetch('/api/logs') " +
               "    .then(response => response.json()) " +
               "    .then(data => { " +
               "      displayLogs(data.logs); " +
               "    }) " +
               "    .catch(error => console.error('로그 가져오기 실패:', error)); " +
               "} " +
               " " +
               "function displayLogs(logs) { " +
               "  const logsContainer = document.getElementById('logs'); " +
               "  logsContainer.innerHTML = ''; " +
               "   " +
               "  logs.forEach(log => { " +
               "    const logEntry = document.createElement('div'); " +
               "    logEntry.className = 'log-entry'; " +
               "    logEntry.textContent = log; " +
               "    logsContainer.appendChild(logEntry); " +
               "  }); " +
               "   " +
               "  logsContainer.scrollTop = logsContainer.scrollHeight; " +
               "} " +
               " " +
               "function clearLogs() { " +
               "  fetch('/api/logs/clear', { method: 'POST' }) " +
               "    .then(response => response.json()) " +
               "    .then(data => { " +
               "      console.log('로그 클리어:', data.message); " +
               "      document.getElementById('logs').innerHTML = ''; " +
               "    }) " +
               "    .catch(error => console.error('로그 클리어 실패:', error)); " +
               "} " +
               "</script> " +
               "</body> " +
               "</html>";
    }

    private static String getLogsJson() {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"logs\": [");

        for (int i = 0; i < logs.size(); i++) {
            if (i > 0) json.append(",");
            json.append("\"").append(logs.get(i).replace("\"", "\\\"")).append("\"");
        }
        json.append("]}");

        return json.toString();
    }
}
package com.example.racecondition;

import org.springframework.web.bind.annotation.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Map;
import java.util.HashMap;

@RestController
@CrossOrigin(origins = "*")
public class RaceConditionController {
    
    private volatile int availableCoupons = 2;
    private final ReentrantLock pessimisticLock = new ReentrantLock();
    private final AtomicInteger version = new AtomicInteger(0);
    private final List<String> winners = Collections.synchronizedList(new ArrayList<>());
    private final List<String> logs = Collections.synchronizedList(new ArrayList<>());
    
    @GetMapping("/api/race")
    public Map<String, Object> testRaceCondition() {
        resetState();
        runConcurrentTest("Race", this::tryGetCouponRace);
        return getResult("Race Condition (무보호)");
    }
    
    @GetMapping("/api/pessimistic")
    public Map<String, Object> testPessimisticLock() {
        resetState();
        runConcurrentTest("Pessimistic", this::tryGetCouponPessimistic);
        return getResult("비관적 락");
    }
    
    @GetMapping("/api/optimistic")
    public Map<String, Object> testOptimisticLock() {
        resetState();
        runConcurrentTest("Optimistic", this::tryGetCouponOptimistic);
        return getResult("낙관적 락");
    }
    
    private void resetState() {
        availableCoupons = 2;
        winners.clear();
        logs.clear();
        version.set(0);
    }
    
    private void runConcurrentTest(String testName, Runnable couponMethod) {
        ExecutorService executor = Executors.newFixedThreadPool(5);
        CountDownLatch startSignal = new CountDownLatch(1);
        CountDownLatch doneSignal = new CountDownLatch(5);
        
        for (int i = 1; i <= 5; i++) {
            final int participantId = i;
            executor.submit(() -> {
                try {
                    startSignal.await();
                    
                    addLog("[" + testName + "] 참가자 " + participantId + " - 시작");
                    couponMethod.run();
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneSignal.countDown();
                }
            });
        }
        
        try {
            Thread.sleep(100);
            addLog("🚀 모든 스레드 동시 시작!");
            startSignal.countDown();
            doneSignal.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            executor.shutdown();
        }
    }
    
    private void tryGetCouponRace() {
        int participantId = getCurrentParticipantId();
        
        addLog("🔍 [Race] 참가자 " + participantId + " - 현재 쿠폰: " + availableCoupons + "개");
        
        if (availableCoupons > 0) {
            int currentCoupons = availableCoupons;
            
            addLog("📖 [Race] 참가자 " + participantId + " - " + currentCoupons + "개 확인, 처리 시작...");
            
            try {
                Thread.sleep(100 + (int)(Math.random() * 100));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            
            if (currentCoupons > 0) {
                availableCoupons--;
                
                addLog("🎯 [Race] 참가자 " + participantId + " - 쿠폰 '획득'! (남은 쿠폰: " + availableCoupons + ")");
                winners.add("참가자" + participantId);
                
                if (availableCoupons < 0) {
                    addLog("💀 [Race] 참가자 " + participantId + " - 심각한 문제! 쿠폰이 음수: " + availableCoupons);
                }
            }
        } else {
            addLog("❌ [Race] 참가자 " + participantId + " - 쿠폰 없음");
        }
    }
    
    private void tryGetCouponPessimistic() {
        int participantId = getCurrentParticipantId();
        
        addLog("🔒 [Pessimistic] 참가자 " + participantId + " - 락 획득 시도...");
        
        pessimisticLock.lock();
        try {
            addLog("🔓 [Pessimistic] 참가자 " + participantId + " - 락 획득 성공!");
            
            if (availableCoupons > 0) {
                Thread.sleep(150);
                
                availableCoupons--;
                addLog("🎯 [Pessimistic] 참가자 " + participantId + " - 쿠폰 획득! (남은 쿠폰: " + availableCoupons + ")");
                winners.add("참가자" + participantId);
            } else {
                addLog("❌ [Pessimistic] 참가자 " + participantId + " - 쿠폰 없음");
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            pessimisticLock.unlock();
            addLog("🔓 [Pessimistic] 참가자 " + participantId + " - 락 해제");
        }
    }
    
    private void tryGetCouponOptimistic() {
        int participantId = getCurrentParticipantId();
        int maxRetries = 3;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            addLog("🔄 [Optimistic] 참가자 " + participantId + " - 시도 " + attempt + "/" + maxRetries);
            
            int currentVersion = version.get();
            int currentCoupons = availableCoupons;
            
            addLog("📊 [Optimistic] 참가자 " + participantId + " - 버전: " + currentVersion + ", 쿠폰: " + currentCoupons);
            
            if (currentCoupons > 0) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
                
                if (version.compareAndSet(currentVersion, currentVersion + 1) && availableCoupons > 0) {
                    availableCoupons--;
                    addLog("🎯 [Optimistic] 참가자 " + participantId + " - 쿠폰 획득! (버전: " + version.get() + ")");
                    winners.add("참가자" + participantId);
                    return;
                } else {
                    addLog("⚠️ [Optimistic] 참가자 " + participantId + " - 버전 충돌! 재시도 " + attempt + "/" + maxRetries);
                    
                    if (attempt < maxRetries) {
                        try {
                            Thread.sleep(50 * attempt);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                    }
                }
            } else {
                addLog("❌ [Optimistic] 참가자 " + participantId + " - 쿠폰 소진");
                return;
            }
        }
        
        addLog("❌ [Optimistic] 참가자 " + participantId + " - 최대 재시도 횟수 초과");
    }
    
    private int getCurrentParticipantId() {
        String threadName = Thread.currentThread().getName();
        if (threadName.contains("pool-") && threadName.contains("thread-")) {
            String[] parts = threadName.split("-");
            return Integer.parseInt(parts[parts.length - 1]);
        }
        return threadName.hashCode() % 5 + 1;
    }
    
    private void addLog(String message) {
        logs.add(message);
    }
    
    private Map<String, Object> getResult(String testType) {
        Map<String, Object> result = new HashMap<>();
        result.put("testType", testType);
        result.put("winners", new ArrayList<>(winners));
        result.put("remainingCoupons", availableCoupons);
        result.put("logs", new ArrayList<>(logs));
        result.put("success", true);
        return result;
    }
}
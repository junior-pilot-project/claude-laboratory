<%@ page language="java" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ page import="java.io.*, java.util.*, java.text.SimpleDateFormat" %>
<%
    // JSP를 통한 메시지 로그 처리
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");

    String method = request.getMethod();

    if ("POST".equals(method)) {
        try {
            // POST 데이터 읽기
            StringBuilder sb = new StringBuilder();
            BufferedReader reader = request.getReader();
            String line;

            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }

            String jsonData = sb.toString();

            // 현재 시간
            Date currentTime = new Date();
            SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            String timestamp = formatter.format(currentTime);

            // 로그 파일에 기록 (선택적)
            String logEntry = String.format("[%s] %s%n", timestamp, jsonData);

            // 세션에 메시지 히스토리 저장
            List<String> messageHistory = (List<String>) session.getAttribute("messageHistory");
            if (messageHistory == null) {
                messageHistory = new ArrayList<String>();
                session.setAttribute("messageHistory", messageHistory);
            }

            messageHistory.add(logEntry);

            // 최대 100개 메시지만 저장
            if (messageHistory.size() > 100) {
                messageHistory.remove(0);
            }

            // 성공 응답
            out.print("{\"status\":\"success\",\"timestamp\":\"" + timestamp + "\"}");

        } catch (Exception e) {
            // 오류 응답
            out.print("{\"status\":\"error\",\"message\":\"" + e.getMessage() + "\"}");
        }
    } else if ("GET".equals(method)) {
        // 메시지 히스토리 조회
        List<String> messageHistory = (List<String>) session.getAttribute("messageHistory");

        out.print("{\"status\":\"success\",\"history\":[");

        if (messageHistory != null && !messageHistory.isEmpty()) {
            for (int i = 0; i < messageHistory.size(); i++) {
                if (i > 0) out.print(",");
                out.print("\"" + messageHistory.get(i).replace("\"", "\\\"") + "\"");
            }
        }

        out.print("]}");
    }
%>
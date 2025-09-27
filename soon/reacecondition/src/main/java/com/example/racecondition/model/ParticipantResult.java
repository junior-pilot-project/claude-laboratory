package com.example.racecondition.model;

import java.time.LocalDateTime;

public class ParticipantResult {
    private int participantId;
    private boolean success;
    private String message;
    private LocalDateTime timestamp;
    private long threadId;
    private String threadName;
    
    public ParticipantResult(int participantId, boolean success, String message) {
        this.participantId = participantId;
        this.success = success;
        this.message = message;
        this.timestamp = LocalDateTime.now();
        this.threadId = Thread.currentThread().getId();
        this.threadName = Thread.currentThread().getName();
    }
    
    // Getters and Setters
    public int getParticipantId() { return participantId; }
    public void setParticipantId(int participantId) { this.participantId = participantId; }
    
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
    
    public long getThreadId() { return threadId; }
    public void setThreadId(long threadId) { this.threadId = threadId; }
    
    public String getThreadName() { return threadName; }
    public void setThreadName(String threadName) { this.threadName = threadName; }
}
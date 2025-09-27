package com.example.racecondition.service;

import com.example.racecondition.model.Coupon;
import com.example.racecondition.model.ParticipantResult;
import com.example.racecondition.repository.CouponRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class CouponService {
    
    @Autowired
    private CouponRepository couponRepository;
    
    private final ReentrantLock pessimisticLock = new ReentrantLock();
    
    /**
     * 쿠폰 초기화 (2개로 설정)
     */
    @Transactional
    public void initializeCoupons() {
        couponRepository.deleteAll();
        couponRepository.save(new Coupon(2)); // ID=1, 쿠폰 2개
    }
    
    /**
     * 1. Race Condition (락 없음) - 진짜 멀티스레드 문제 발생!
     */
    public List<ParticipantResult> runRaceCondition() throws InterruptedException {
        initializeCoupons();
        
        List<ParticipantResult> results = new ArrayList<>();
        ExecutorService executor = Executors.newFixedThreadPool(5);
        CountDownLatch startLatch = new CountDownLatch(1); // 동시 시작용
        CountDownLatch doneLatch = new CountDownLatch(5);  // 완료 대기용
        
        // 5명의 참가자가 동시에 쿠폰 요청
        for (int i = 1; i <= 5; i++) {
            final int participantId = i;
            executor.submit(() -> {
                try {
                    startLatch.await(); // 모든 스레드가 동시에 시작하도록 대기
                    ParticipantResult result = tryGetCouponRace(participantId);
                    synchronized (results) {
                        results.add(result);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }
        
        startLatch.countDown(); // 모든 스레드 동시 시작!
        doneLatch.await();      // 모든 스레드 완료 대기
        executor.shutdown();
        
        return results;
    }
    
    @Transactional
    public ParticipantResult tryGetCouponRace(int participantId) {
        try {
            System.out.printf("🔍 [Race] 참가자 %d (스레드: %s) - 쿠폰 확인 시작%n", 
                            participantId, Thread.currentThread().getName());
            
            Coupon coupon = couponRepository.findById(1L).orElse(null);
            if (coupon == null) {
                return new ParticipantResult(participantId, false, "쿠폰을 찾을 수 없음");
            }
            
            int currentCount = coupon.getAvailableCount();
            System.out.printf("📖 [Race] 참가자 %d - 현재 쿠폰 %d개 확인, 처리 시작...%n", 
                            participantId, currentCount);
            
            // 💥 Race Condition 핵심: 모든 스레드가 동시에 이 조건을 통과할 수 있음!
            if (currentCount > 0) {
                // 실제 처리 시간 시뮬레이션 (100-300ms)
                Thread.sleep(100 + (int)(Math.random() * 200));
                
                // 💀 여기서 문제! 다른 스레드가 이미 차감했을 수도 있지만 검사하지 않음
                coupon.setAvailableCount(currentCount - 1);
                couponRepository.save(coupon);
                
                int newCount = coupon.getAvailableCount();
                System.out.printf("🎯 [Race] 참가자 %d - 쿠폰 획득! (남은 쿠폰: %d)%n", 
                                participantId, newCount);
                
                if (newCount < 0) {
                    System.out.printf("💀 [Race] 참가자 %d - 심각한 문제! 쿠폰이 음수: %d%n", 
                                    participantId, newCount);
                }
                
                return new ParticipantResult(participantId, true, 
                    String.format("쿠폰 획득 성공! (남은 쿠폰: %d)", newCount));
            }
            
        } catch (Exception e) {
            System.out.printf("❌ [Race] 참가자 %d - 오류: %s%n", participantId, e.getMessage());
        }
        
        return new ParticipantResult(participantId, false, "쿠폰 획득 실패");
    }
    
    /**
     * 2. 비관적 락 (Pessimistic Lock) - 순차적 안전한 접근
     */
    public List<ParticipantResult> runPessimisticLock() throws InterruptedException {
        initializeCoupons();
        
        List<ParticipantResult> results = new ArrayList<>();
        ExecutorService executor = Executors.newFixedThreadPool(5);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(5);
        
        for (int i = 1; i <= 5; i++) {
            final int participantId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    ParticipantResult result = tryGetCouponPessimistic(participantId);
                    synchronized (results) {
                        results.add(result);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }
        
        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();
        
        return results;
    }
    
    @Transactional
    public ParticipantResult tryGetCouponPessimistic(int participantId) {
        System.out.printf("🔒 [Pessimistic] 참가자 %d - 락 획득 시도...%n", participantId);
        
        // 🔒 애플리케이션 레벨 락 + DB 레벨 락 조합
        pessimisticLock.lock();
        try {
            System.out.printf("🔓 [Pessimistic] 참가자 %d - 락 획득 성공! (스레드: %s)%n", 
                            participantId, Thread.currentThread().getName());
            
            // DB 레벨 비관적 락
            Coupon coupon = couponRepository.findByIdWithPessimisticLock(1L).orElse(null);
            if (coupon == null) {
                return new ParticipantResult(participantId, false, "쿠폰을 찾을 수 없음");
            }
            
            if (coupon.getAvailableCount() > 0) {
                // Critical Section에서 안전한 작업
                Thread.sleep(200); // 처리 시간 시뮬레이션
                
                coupon.setAvailableCount(coupon.getAvailableCount() - 1);
                couponRepository.save(coupon);
                
                System.out.printf("🎯 [Pessimistic] 참가자 %d - 쿠폰 획득! (남은 쿠폰: %d)%n", 
                                participantId, coupon.getAvailableCount());
                
                return new ParticipantResult(participantId, true, 
                    String.format("쿠폰 획득 성공! (남은 쿠폰: %d)", coupon.getAvailableCount()));
            } else {
                System.out.printf("❌ [Pessimistic] 참가자 %d - 쿠폰 없음%n", participantId);
                return new ParticipantResult(participantId, false, "쿠폰 소진");
            }
            
        } catch (Exception e) {
            System.out.printf("❌ [Pessimistic] 참가자 %d - 오류: %s%n", participantId, e.getMessage());
            return new ParticipantResult(participantId, false, "처리 중 오류 발생");
        } finally {
            pessimisticLock.unlock();
            System.out.printf("🔓 [Pessimistic] 참가자 %d - 락 해제%n", participantId);
        }
    }
    
    /**
     * 3. 낙관적 락 (Optimistic Lock) - 버전 기반 충돌 감지 및 재시도
     */
    public List<ParticipantResult> runOptimisticLock() throws InterruptedException {
        initializeCoupons();
        
        List<ParticipantResult> results = new ArrayList<>();
        ExecutorService executor = Executors.newFixedThreadPool(5);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(5);
        
        for (int i = 1; i <= 5; i++) {
            final int participantId = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    ParticipantResult result = tryGetCouponOptimistic(participantId);
                    synchronized (results) {
                        results.add(result);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            });
        }
        
        startLatch.countDown();
        doneLatch.await();
        executor.shutdown();
        
        return results;
    }
    
    public ParticipantResult tryGetCouponOptimistic(int participantId) {
        int maxRetries = 3;
        
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                System.out.printf("🔄 [Optimistic] 참가자 %d - 시도 %d/%d (스레드: %s)%n", 
                                participantId, attempt, maxRetries, Thread.currentThread().getName());
                
                return attemptOptimisticCoupon(participantId, attempt);
                
            } catch (ObjectOptimisticLockingFailureException e) {
                System.out.printf("⚠️ [Optimistic] 참가자 %d - 버전 충돌 감지! 재시도 %d/%d%n", 
                                participantId, attempt, maxRetries);
                
                if (attempt < maxRetries) {
                    try {
                        // 지수 백오프
                        Thread.sleep(100 * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                } else {
                    System.out.printf("❌ [Optimistic] 참가자 %d - 최대 재시도 횟수 초과%n", participantId);
                    return new ParticipantResult(participantId, false, 
                        String.format("최대 재시도 횟수 초과 (%d번 시도)", maxRetries));
                }
            } catch (Exception e) {
                System.out.printf("❌ [Optimistic] 참가자 %d - 오류: %s%n", participantId, e.getMessage());
                return new ParticipantResult(participantId, false, "처리 중 오류 발생");
            }
        }
        
        return new ParticipantResult(participantId, false, "재시도 실패");
    }
    
    @Transactional
    public ParticipantResult attemptOptimisticCoupon(int participantId, int attempt) {
        Coupon coupon = couponRepository.findById(1L).orElse(null);
        if (coupon == null) {
            return new ParticipantResult(participantId, false, "쿠폰을 찾을 수 없음");
        }
        
        System.out.printf("📊 [Optimistic] 참가자 %d - 현재 버전: %d, 쿠폰: %d개%n", 
                        participantId, coupon.getVersion(), coupon.getAvailableCount());
        
        if (coupon.getAvailableCount() > 0) {
            try {
                // 처리 시간 시뮬레이션
                Thread.sleep(100);
                
                coupon.setAvailableCount(coupon.getAvailableCount() - 1);
                couponRepository.save(coupon); // @Version이 자동으로 충돌 검사
                
                System.out.printf("🎯 [Optimistic] 참가자 %d - 쿠폰 획득! (버전: %d, 남은 쿠폰: %d)%n", 
                                participantId, coupon.getVersion(), coupon.getAvailableCount());
                
                return new ParticipantResult(participantId, true, 
                    String.format("쿠폰 획득 성공! (시도: %d회, 남은 쿠폰: %d)", attempt, coupon.getAvailableCount()));
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return new ParticipantResult(participantId, false, "처리 중단됨");
            }
        } else {
            System.out.printf("❌ [Optimistic] 참가자 %d - 쿠폰 소진%n", participantId);
            return new ParticipantResult(participantId, false, "쿠폰 소진");
        }
    }
    
    /**
     * 현재 쿠폰 상태 조회
     */
    public Coupon getCouponStatus() {
        return couponRepository.findById(1L).orElse(new Coupon(0));
    }
}
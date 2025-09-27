package com.example.racecondition.controller;

import com.example.racecondition.model.Coupon;
import com.example.racecondition.model.ParticipantResult;
import com.example.racecondition.service.CouponService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coupon")
@CrossOrigin(origins = "*") // CORS 허용
public class CouponController {
    
    @Autowired
    private CouponService couponService;
    
    /**
     * 쿠폰 상태 조회
     */
    @GetMapping("/status")
    public ResponseEntity<Coupon> getCouponStatus() {
        Coupon coupon = couponService.getCouponStatus();
        return ResponseEntity.ok(coupon);
    }
    
    /**
     * 쿠폰 초기화
     */
    @PostMapping("/initialize")
    public ResponseEntity<Map<String, String>> initializeCoupons() {
        couponService.initializeCoupons();
        Map<String, String> response = new HashMap<>();
        response.put("message", "쿠폰이 2개로 초기화되었습니다");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Race Condition 시뮬레이션 (락 없음)
     */
    @PostMapping("/race")
    public ResponseEntity<Map<String, Object>> runRaceCondition() {
        try {
            List<ParticipantResult> results = couponService.runRaceCondition();
            Coupon finalStatus = couponService.getCouponStatus();
            
            Map<String, Object> response = new HashMap<>();
            response.put("type", "race");
            response.put("results", results);
            response.put("finalCouponCount", finalStatus.getAvailableCount());
            response.put("winners", results.stream().filter(ParticipantResult::isSuccess).map(ParticipantResult::getParticipantId).collect(java.util.stream.Collectors.toList()));
            response.put("message", "Race Condition 시뮬레이션 완료");
            
            return ResponseEntity.ok(response);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "시뮬레이션이 중단되었습니다");
            return ResponseEntity.status(500).body(errorResponse);
        }
    }
    
    /**
     * 비관적 락 시뮬레이션
     */
    @PostMapping("/pessimistic")
    public ResponseEntity<Map<String, Object>> runPessimisticLock() {
        try {
            List<ParticipantResult> results = couponService.runPessimisticLock();
            Coupon finalStatus = couponService.getCouponStatus();
            
            Map<String, Object> response = new HashMap<>();
            response.put("type", "pessimistic");
            response.put("results", results);
            response.put("finalCouponCount", finalStatus.getAvailableCount());
            response.put("winners", results.stream().filter(ParticipantResult::isSuccess).map(ParticipantResult::getParticipantId).collect(java.util.stream.Collectors.toList()));
            response.put("message", "비관적 락 시뮬레이션 완료");
            
            return ResponseEntity.ok(response);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "시뮬레이션이 중단되었습니다");
            return ResponseEntity.status(500).body(errorResponse);
        }
    }
    
    /**
     * 낙관적 락 시뮬레이션
     */
    @PostMapping("/optimistic")
    public ResponseEntity<Map<String, Object>> runOptimisticLock() {
        try {
            List<ParticipantResult> results = couponService.runOptimisticLock();
            Coupon finalStatus = couponService.getCouponStatus();
            
            Map<String, Object> response = new HashMap<>();
            response.put("type", "optimistic");
            response.put("results", results);
            response.put("finalCouponCount", finalStatus.getAvailableCount());
            response.put("winners", results.stream().filter(ParticipantResult::isSuccess).map(ParticipantResult::getParticipantId).collect(java.util.stream.Collectors.toList()));
            response.put("message", "낙관적 락 시뮬레이션 완료");
            
            return ResponseEntity.ok(response);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "시뮬레이션이 중단되었습니다");
            return ResponseEntity.status(500).body(errorResponse);
        }
    }
}
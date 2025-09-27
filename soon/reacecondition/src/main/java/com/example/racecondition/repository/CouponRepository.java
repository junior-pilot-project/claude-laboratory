package com.example.racecondition.repository;

import com.example.racecondition.model.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import javax.persistence.LockModeType;
import java.util.Optional;

@Repository
public interface CouponRepository extends JpaRepository<Coupon, Long> {
    
    // 비관적 락 - 쓰기 락을 즉시 획득
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Coupon c WHERE c.id = :id")
    Optional<Coupon> findByIdWithPessimisticLock(Long id);
    
    // 낙관적 락용 - @Version이 자동으로 처리됨
    @Override
    Optional<Coupon> findById(Long id);
}
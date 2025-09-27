# 🎯 실제 멀티스레드 Race Condition 데모

Java Spring Boot + 웹 프론트엔드로 구현된 **진짜 멀티스레드 환경**에서의 Race Condition 시연

## 🚀 빠른 시작

### 1. 서버 실행

**Windows:**
```bash
start-server.bat
```

**Linux/Mac:**
```bash
./start-server.sh
```

**또는 수동 실행:**
```bash
mvn spring-boot:run
# 또는
./mvnw spring-boot:run
```

### 2. 웹 브라우저에서 접속

1. 서버 실행 후 웹 브라우저에서 `http://localhost:8000/index.html` 접속
2. 3가지 시나리오 테스트:
   - ⚡ **Race Condition**: 락 없이 5개 스레드 동시 실행
   - 🔒 **비관적 락**: ReentrantLock + DB 락 조합
   - 🔄 **낙관적 락**: @Version 기반 충돌 감지

## 🎮 데모 시나리오

### ⚡ Race Condition (락 없음)
- **문제점**: 5명 모두가 쿠폰을 "획득"할 수 있음
- **결과**: 쿠폰 잔여가 음수로 떨어질 수 있음
- **서버 로그**: 실제 멀티스레드 충돌 상황 확인 가능

### 🔒 비관적 락 (Pessimistic Lock)
- **해결**: `ReentrantLock` + JPA `PESSIMISTIC_WRITE` 락
- **결과**: 순차적 처리로 정확히 2명만 쿠폰 획득
- **특징**: 락 대기 시간이 길수록 성능 저하

### 🔄 낙관적 락 (Optimistic Lock)
- **해결**: JPA `@Version` 기반 충돌 감지
- **결과**: 충돌 시 최대 3회 재시도
- **특징**: 높은 동시성, 충돌 빈도에 따라 성능 좌우

## 🔍 서버 로그 확인

Java 서버 콘솔에서 실제 멀티스레드 동작을 확인할 수 있습니다:

```
🔍 [Race] 참가자 1 (스레드: pool-2-thread-1) - 쿠폰 확인 시작
🔍 [Race] 참가자 2 (스레드: pool-2-thread-2) - 쿠폰 확인 시작
📖 [Race] 참가자 1 - 현재 쿠폰 2개 확인, 처리 시작...
📖 [Race] 참가자 2 - 현재 쿠폰 2개 확인, 처리 시작...
💀 [Race] 참가자 3 - 심각한 문제! 쿠폰이 음수가 됨: -1
```

## 🏗️ 기술 스택

- **백엔드**: Java 17, Spring Boot 3.2, JPA, H2 Database
- **프론트엔드**: HTML5, CSS3, Vanilla JavaScript
- **동시성**: `ExecutorService`, `CountDownLatch`, `ReentrantLock`
- **데이터베이스**: H2 인메모리 DB (개발용)

## 📋 주요 구현 포인트

### 진짜 멀티스레드 구현
```java
ExecutorService executor = Executors.newFixedThreadPool(5);
CountDownLatch startLatch = new CountDownLatch(1); // 동시 시작
CountDownLatch doneLatch = new CountDownLatch(5);  // 완료 대기

// 5개 스레드 동시 시작
startLatch.countDown();
```

### Race Condition 재현
```java
// 💥 문제가 있는 코드!
if (coupon.getAvailableCount() > 0) {
    Thread.sleep(100); // 다른 스레드 개입 여지
    coupon.setAvailableCount(currentCount - 1); // 동시 차감!
}
```

### 비관적 락 해결
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
Coupon findByIdWithPessimisticLock(Long id);
```

### 낙관적 락 해결
```java
@Entity
public class Coupon {
    @Version
    private Long version; // 자동 충돌 감지
}
```

## 🎯 학습 목표

1. **멀티스레드 환경의 위험성** 이해
2. **Race Condition** 문제점 체험
3. **비관적 락 vs 낙관적 락** 차이점 학습
4. **실제 운영 환경** 고려사항 파악

---

**💡 Tip**: 각 시나리오를 여러 번 실행해보면서 결과가 매번 달라지는 것을 확인해보세요!
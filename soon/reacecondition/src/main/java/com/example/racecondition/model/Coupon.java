package com.example.racecondition.model;

import javax.persistence.*;

@Entity
@Table(name = "coupons")
public class Coupon {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "available_count")
    private Integer availableCount;
    
    @Version
    private Long version; // 낙관적 락용
    
    public Coupon() {}
    
    public Coupon(Integer availableCount) {
        this.availableCount = availableCount;
    }
    
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public Integer getAvailableCount() { return availableCount; }
    public void setAvailableCount(Integer availableCount) { this.availableCount = availableCount; }
    
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
@echo off
echo 🚀 Java Spring Boot 서버를 시작합니다...
echo.
echo 📋 실제 멀티스레드 Race Condition 데모
echo 💡 5개의 실제 Java 스레드가 2개 쿠폰을 놓고 경쟁합니다!
echo.

if exist mvnw.cmd (
    echo Maven Wrapper를 사용하여 서버를 시작합니다...
    mvnw.cmd spring-boot:run
) else if exist pom.xml (
    echo Maven을 사용하여 서버를 시작합니다...
    mvn spring-boot:run
) else (
    echo ❌ Maven 프로젝트가 아닙니다. pom.xml 파일을 확인해주세요.
    pause
)

echo.
echo 서버가 종료되었습니다.
pause
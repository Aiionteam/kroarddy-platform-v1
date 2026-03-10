# Build stage
FROM gradle:8.5-jdk21 AS builder
WORKDIR /build

# Gradle 설정 파일 먼저 복사 (의존성 캐싱을 위해)
COPY build.gradle settings.gradle ./
COPY gradle.properties* ./
COPY gradle/ ./gradle/
COPY gateway/build.gradle ./gateway/

# 의존성 다운로드 (Gradle 캐시 활용 + 최적화 옵션)
RUN --mount=type=cache,target=/root/.gradle/caches \
    --mount=type=cache,target=/root/.gradle/wrapper \
    gradle :gateway:dependencies --no-daemon --parallel || true

# 나머지 소스 코드 복사 (services는 gateway 내부에 포함)
COPY gateway/ ./gateway/

# 빌드 실행 (상세한 로그 출력)
RUN --mount=type=cache,target=/root/.gradle/caches \
    --mount=type=cache,target=/root/.gradle/wrapper \
    gradle :gateway:build -x test --no-daemon --stacktrace --info

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /build/gateway/build/libs/*.jar app.jar
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

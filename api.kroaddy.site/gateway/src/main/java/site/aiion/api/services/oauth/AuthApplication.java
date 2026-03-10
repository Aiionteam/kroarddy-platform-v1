package site.aiion.api.services.oauth;

// Spring Cloud 제거로 import 불필요
// import org.springframework.boot.SpringApplication;
// import org.springframework.boot.autoconfigure.SpringBootApplication;
// import org.springframework.cloud.autoconfigure.RefreshAutoConfiguration;
// import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

// GatewayApplication에서 통합 실행되므로 별도 실행 불필요
// @EnableDiscoveryClient
// @SpringBootApplication(scanBasePackages = "site.aiion.api.oauth", exclude = {
// 		RefreshAutoConfiguration.class
// })
public class AuthApplication {

	// GatewayApplication에서 통합 실행되므로 main 메서드 제거
	// public static void main(String[] args) {
	// 	SpringApplication.run(AuthApplication.class, args);
	// }

}

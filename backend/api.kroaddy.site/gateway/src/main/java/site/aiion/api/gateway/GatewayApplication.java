package site.aiion.api.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

// Spring Cloud Gateway 제거로 @EnableDiscoveryClient 불필요
@SpringBootApplication
@ComponentScan(basePackages = {
	"site.aiion.api.gateway",
	"site.aiion.api.services"
})
@EntityScan(basePackages = {
	"site.aiion.api.services.user",
	"site.aiion.api.services.groupchat",
	"site.aiion.api.services.whisper"
})
@EnableScheduling
@EnableJpaRepositories(basePackages = {
	"site.aiion.api.services.user",
	"site.aiion.api.services.groupchat",
	"site.aiion.api.services.whisper"
})
public class GatewayApplication {

	public static void main(String[] args) {
		SpringApplication.run(GatewayApplication.class, args);
	}

}


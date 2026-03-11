package site.aiion.api.gateway.proxy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Enumeration;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class AiServiceProxyController {

	private final RestTemplate restTemplate;

	// 환경 변수로 관리
	// Docker Compose: http://rag-service:8001, http://vision-service:8002
	// EC2 독립 인스턴스: http://chat.hohyun.site:8001, http://vision.hohyun.site:8002
	// Vision 서비스는 선택적 (나중에 배포 가능)
	@Value("${ai.service.rag.url:http://chat.hohyun.site:8001}")
	private String ragServiceUrl;

	@Value("${ai.service.vision.url:}")
	private String visionServiceUrl;

	@Value("${ai.service.festival.url:http://localhost:8002}")
	private String festivalServiceUrl;

	@Value("${ai.service.tourplaner.url:http://localhost:8003}")
	private String tourplanerServiceUrl;

	@Value("${ai.service.user-info.url:http://localhost:8004}")
	private String userInfoServiceUrl;

	@Value("${ai.service.tourstar.url:http://localhost:8010}")
	private String tourstarServiceUrl;

	public AiServiceProxyController(RestTemplate restTemplate)
	{
		this.restTemplate = restTemplate;
	}

	// YOLO 서비스 프록시 (vision-service 통합)
	@RequestMapping({"/yolo/**"})
	public ResponseEntity<String> proxyYoloService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		// Vision 서비스가 배포되지 않은 경우 처리
		if (visionServiceUrl == null || visionServiceUrl.isEmpty()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
					.body("{\"error\": \"Vision service is not available yet\"}");
		}
		return proxyRequest(visionServiceUrl + "/yolo", body, method, request, headers);
	}

	// RAG OpenAI 서비스 프록시
	@RequestMapping({"/rag/openai/**"})
	public ResponseEntity<String> proxyRagOpenAIService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		// ragServiceUrl은 base URL만 포함 (예: http://chat.hohyun.site:8001)
		// /api/rag/openai/** → /rag/openai/**로 변환되어 ragServiceUrl과 결합
		return proxyRequest(ragServiceUrl, body, method, request, headers);
	}

	// RAG Llama 서비스 프록시
	@RequestMapping({"/rag/llama/**"})
	public ResponseEntity<String> proxyRagLlamaService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		// ragServiceUrl은 base URL만 포함 (예: http://chat.hohyun.site:8001)
		// /api/rag/llama/** → /rag/llama/**로 변환되어 ragServiceUrl과 결합
		return proxyRequest(ragServiceUrl, body, method, request, headers);
	}

	// Festival 서비스 프록시 (8002) - /api/v1/festivals, /api/v1/festivals/** → festival service
	@RequestMapping({"/v1/festivals", "/v1/festivals/**"})
	public ResponseEntity<String> proxyFestivalService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(festivalServiceUrl + "/api", body, method, request, headers);
	}

	// Tourplaner 서비스 프록시 (8003) - /api/v1/weather, /api/v1/weather/** → tourplaner service
	@RequestMapping({"/v1/weather", "/v1/weather/**"})
	public ResponseEntity<String> proxyTourplanerWeather(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(tourplanerServiceUrl + "/api", body, method, request, headers);
	}

	// Planner 서비스 프록시 (8003) - /api/v1/planner/** → tourplaner service
	@RequestMapping({"/v1/planner", "/v1/planner/**"})
	public ResponseEntity<String> proxyTourplanerPlanner(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(tourplanerServiceUrl + "/api", body, method, request, headers);
	}

	// User Content 서비스 프록시 (8003) - /api/v1/user-content/** → tourplaner service
	@RequestMapping({"/v1/user-content", "/v1/user-content/**"})
	public ResponseEntity<String> proxyUserContent(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(tourplanerServiceUrl + "/api", body, method, request, headers);
	}

	// K-Content 서비스 프록시 (8003) - /api/v1/k-content/** → tourplaner service
	@RequestMapping({"/v1/k-content", "/v1/k-content/**"})
	public ResponseEntity<String> proxyKContent(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(tourplanerServiceUrl + "/api", body, method, request, headers);
	}

	// User Profile 서비스 프록시 (8004) - /api/v1/user-profile/** → user_info service
	@RequestMapping({"/v1/user-profile", "/v1/user-profile/**"})
	public ResponseEntity<String> proxyUserInfoService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(userInfoServiceUrl + "/api", body, method, request, headers);
	}

	// Tourstar 서비스 프록시 (8010) - /api/v1/photo-selection/** → tourstar service
	@RequestMapping({"/v1/photo-selection", "/v1/photo-selection/**"})
	public ResponseEntity<String> proxyTourstarService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(tourstarServiceUrl, body, method, request, headers);
	}

	// Tourstar 정적 파일 프록시 (8010) - /api/tourstar-files/** → tourstar service
	@RequestMapping({"/tourstar-files/**"})
	public ResponseEntity<String> proxyTourstarFiles(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		return proxyRequest(tourstarServiceUrl, body, method, request, headers);
	}

	// LangGraph 채팅 서비스 프록시 (8001 → 게이트웨이 경유로 통일)
	// /api/v1/admin/** → ragServiceUrl(8001)/api/v1/admin/**
	@RequestMapping({"/v1/admin/**"})
	public ResponseEntity<String> proxyLangGraphAdmin(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		// path: /api 제거 후 /v1/admin/... → ragServiceUrl + "/api" + path
		return proxyRequest(ragServiceUrl + "/api", body, method, request, headers);
	}

	// Diffusers 서비스 프록시 (vision-service 통합)
	@RequestMapping({"/diffusers/**"})
	public ResponseEntity<String> proxyDiffusersService(
			@RequestBody(required = false) String body,
			HttpMethod method,
			HttpServletRequest request,
			@RequestHeader HttpHeaders headers)
	{
		// Vision 서비스가 배포되지 않은 경우 처리
		if (visionServiceUrl == null || visionServiceUrl.isEmpty()) {
			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
					.body("{\"error\": \"Vision service is not available yet\"}");
		}
		return proxyRequest(visionServiceUrl + "/diffusers", body, method, request, headers);
	}

	// 업스트림 FastAPI 서비스가 자체적으로 붙이는 CORS 헤더.
	// 게이트웨이(Spring Security)가 CORS를 전담하므로, 업스트림 CORS 헤더는 제거해야 한다.
	// 두 값이 공존하면 브라우저가 "multiple values" 오류로 요청을 차단한다.
	private static final Set<String> UPSTREAM_CORS_HEADERS = Set.of(
			"access-control-allow-origin",
			"access-control-allow-methods",
			"access-control-allow-headers",
			"access-control-allow-credentials",
			"access-control-expose-headers",
			"access-control-max-age"
	);

	private ResponseEntity<String> proxyRequest(
			String baseUrl,
			String body,
			HttpMethod method,
			HttpServletRequest request,
			HttpHeaders headers)
	{

		String requestUri = request.getRequestURI();
		String queryString = request.getQueryString();

		// Remove the /api prefix from the request URI for the target service
		String path = requestUri.replaceFirst("/api", "");

		URI uri = UriComponentsBuilder.fromUriString(baseUrl)
				.path(path)
				.query(queryString)
				.build(true)
				.toUri();

		HttpHeaders proxyHeaders = new HttpHeaders();
		// Copy all original headers except Host and Content-Length
		Enumeration<String> headerNames = request.getHeaderNames();
		while (headerNames.hasMoreElements())
		{
			String headerName = headerNames.nextElement();
			if (!headerName.equalsIgnoreCase(HttpHeaders.HOST) && !headerName.equalsIgnoreCase(HttpHeaders.CONTENT_LENGTH))
			{
				proxyHeaders.add(headerName, request.getHeader(headerName));
			}
		}

		// Ensure Content-Type is set if a body exists
		if (body != null && !body.isEmpty() && proxyHeaders.getContentType() == null)
		{
			proxyHeaders.setContentType(MediaType.APPLICATION_JSON); // Default to JSON if not specified
		}

		org.springframework.http.HttpEntity<String> httpEntity = new org.springframework.http.HttpEntity<>(body, proxyHeaders);

		try
		{
			ResponseEntity<String> responseEntity = restTemplate.exchange(uri, method, httpEntity, String.class);
			HttpHeaders filteredHeaders = filterUpstreamCorsHeaders(responseEntity.getHeaders());
			return ResponseEntity.status(responseEntity.getStatusCode())
					.headers(filteredHeaders)
					.body(responseEntity.getBody());
		}
		catch (HttpClientErrorException | HttpServerErrorException e)
		{
			HttpHeaders filteredHeaders = filterUpstreamCorsHeaders(e.getResponseHeaders());
			return ResponseEntity.status(e.getStatusCode())
					.headers(filteredHeaders)
					.body(e.getResponseBodyAsString());
		}
		catch (Exception e)
		{
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body("Proxy error: " + e.getMessage());
		}
	}

	/** 업스트림 서비스의 CORS 헤더를 제거한 새 HttpHeaders 반환 */
	private HttpHeaders filterUpstreamCorsHeaders(HttpHeaders source)
	{
		if (source == null) return new HttpHeaders();
		HttpHeaders filtered = new HttpHeaders();
		source.forEach((name, values) -> {
			if (!UPSTREAM_CORS_HEADERS.contains(name.toLowerCase()))
			{
				filtered.addAll(name, values);
			}
		});
		return filtered;
	}
}


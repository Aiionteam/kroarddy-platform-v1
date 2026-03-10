package site.aiion.api.services.oauth.kakao;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.view.RedirectView;

/**
 * Kakao OAuth2 표준 콜백 경로 처리
 * Kakao Developers에 등록된 redirect URI: /oauth2/kakao/callback
 * 실제 처리는 KakaoController의 kakaoCallback 메서드를 재사용
 */
@RestController
@RequestMapping("/oauth2")
public class KakaoOAuth2CallbackController {
    
    private final KakaoController kakaoController;
    
    public KakaoOAuth2CallbackController(KakaoController kakaoController) {
        this.kakaoController = kakaoController;
    }
    
    /**
     * Kakao OAuth2 표준 콜백 경로
     * /oauth2/kakao/callback -> KakaoController.kakaoCallback()로 위임
     */
    @GetMapping("/kakao/callback")
    public RedirectView kakaoCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description,
            jakarta.servlet.http.HttpServletResponse response) {
        return kakaoController.kakaoCallback(code, state, error, error_description, response);
    }
}


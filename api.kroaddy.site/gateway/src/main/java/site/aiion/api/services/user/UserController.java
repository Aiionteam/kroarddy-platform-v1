package site.aiion.api.services.user;

import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import site.aiion.api.services.user.common.domain.Messenger;
import site.aiion.api.services.oauth.util.JwtTokenProvider;

/**
 * [메모] www.tourstory.site 설정 페이지(/settings) 연동
 * - /home 등에서 "설정" 메뉴 클릭 시 설정 페이지에서 사용자 정보·닉네임 CRUD 사용
 * - findById(R): 설정 페이지 진입 시 사용자 정보 조회
 * - update(U): 설정 페이지에서 닉네임 등 수정 후 저장
 */
@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/users", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
@Tag(name = "User", description = "사용자 관리 기능")
public class UserController {

    private final UserService userService;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping("/findById")
    @Operation(summary = "사용자 ID로 조회", description = "사용자 ID를 받아 해당 사용자 정보를 조회합니다.")
    public Messenger findById(@RequestBody UserModel userModel) {
        return userService.findById(userModel);
    }

    @GetMapping("/findByEmailAndProvider")
    @Operation(summary = "이메일과 제공자로 조회", description = "이메일과 OAuth 제공자로 사용자 정보를 조회합니다.")
    public Messenger findByEmailAndProvider(
            @org.springframework.web.bind.annotation.RequestParam String email,
            @org.springframework.web.bind.annotation.RequestParam String provider) {
        return userService.findByEmailAndProvider(email, provider);
    }

    @GetMapping
    @Operation(summary = "전체 사용자 조회", description = "모든 사용자 정보를 조회합니다.")
    public Messenger findAll() {
        return userService.findAll();
    }

    @PostMapping
    @Operation(summary = "사용자 저장", description = "새로운 사용자 정보를 저장합니다.")
    public Messenger save(@RequestBody UserModel userModel) {
        return userService.save(userModel);
    }

    @PostMapping("/saveAll")
    @Operation(summary = "사용자 일괄 저장", description = "여러 사용자 정보를 한 번에 저장합니다.")
    public Messenger saveAll(@RequestBody List<UserModel> userModelList) {
        return userService.saveAll(userModelList);
    }

    @PutMapping
    @Operation(summary = "사용자 수정", description = "기존 사용자 정보를 수정합니다.")
    public Messenger update(@RequestBody UserModel userModel) {
        return userService.update(userModel);
    }

    @DeleteMapping
    @Operation(summary = "사용자 삭제", description = "사용자 정보를 삭제합니다.")
    public Messenger delete(@RequestBody UserModel userModel) {
        return userService.delete(userModel);
    }

    @PostMapping("/honor/vote")
    @Operation(summary = "명예도 올리기/내리기", description = "다른 사용자에게 명예도 UP(+1) 또는 DOWN(-1). 하루에 한 번만 동일 액션 가능.")
    public Messenger voteHonor(
            @RequestBody java.util.Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Messenger.builder().code(401).message("인증이 필요합니다.").build();
        }
        String token = authHeader.substring(7);
        if (!jwtTokenProvider.validateToken(token)) {
            return Messenger.builder().code(401).message("유효하지 않은 토큰입니다.").build();
        }
        Long voterId;
        try {
            voterId = Long.parseLong(jwtTokenProvider.getUserIdFromToken(token));
        } catch (NumberFormatException e) {
            return Messenger.builder().code(401).message("토큰에서 사용자 ID를 추출할 수 없습니다.").build();
        }
        Object targetObj = body.get("targetUserId");
        Object actionObj = body.get("action");
        if (targetObj == null || actionObj == null) {
            return Messenger.builder().code(400).message("targetUserId와 action(UP/DOWN)이 필요합니다.").build();
        }
        Long targetUserId = targetObj instanceof Number ? ((Number) targetObj).longValue() : Long.parseLong(targetObj.toString());
        String action = actionObj.toString().toUpperCase();
        return userService.voteHonor(voterId, targetUserId, action);
    }

}

package br.com.pocarsport.api.auth;

import java.util.List;
import java.util.Map;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Tela Usuários: só o administrador. */
@RestController
@RequestMapping("/api/usuarios")
public class UsuariosController {

    private final UsuarioAtual usuarioAtual;
    private final Acessos acessos;
    private final UsuariosService service;

    public UsuariosController(UsuarioAtual usuarioAtual, Acessos acessos, UsuariosService service) {
        this.usuarioAtual = usuarioAtual;
        this.acessos = acessos;
        this.service = service;
    }

    private Usuario admin(Authentication auth) {
        Usuario u = usuarioAtual.de(auth);
        acessos.exigirAdmin(u);
        return u;
    }

    @GetMapping
    public List<Map<String, Object>> listar(Authentication auth) {
        admin(auth);
        return service.listar();
    }

    @PostMapping
    public Map<String, Object> criar(@RequestBody UsuariosService.Novo p, Authentication auth) {
        return Map.of("id", service.criar(p, admin(auth)));
    }

    @PutMapping("/{id}")
    public Map<String, Object> editar(@PathVariable long id, @RequestBody UsuariosService.Edicao p, Authentication auth) {
        service.editar(id, p, admin(auth));
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/senha")
    public Map<String, Object> redefinirSenha(@PathVariable long id, @RequestBody UsuariosService.NovaSenha p, Authentication auth) {
        service.redefinirSenha(id, p.senha(), admin(auth));
        return Map.of("ok", true);
    }
}

package br.com.pocarsport.api.auditoria;

import br.com.pocarsport.api.auth.Acessos;
import br.com.pocarsport.api.auth.UsuarioAtual;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auditoria")
public class AuditoriaController {

    private static final int LIMITE_MAXIMO = 500;

    private final AuditoriaService service;
    private final UsuarioAtual usuarioAtual;
    private final Acessos acessos;

    public AuditoriaController(AuditoriaService service, UsuarioAtual usuarioAtual, Acessos acessos) {
        this.service = service;
        this.usuarioAtual = usuarioAtual;
        this.acessos = acessos;
    }

    public record Pagina(List<RegistroAuditoria> registros, boolean temMais) {
    }

    @GetMapping
    public Pagina buscar(@RequestParam(required = false) String usuario,
                         @RequestParam(defaultValue = "7d") String periodo,
                         @RequestParam(required = false) String busca,
                         @RequestParam(required = false) Long antesDe,
                         @RequestParam(defaultValue = "100") int limite, Authentication auth) {
        acessos.exigir(usuarioAtual.de(auth), "auditoria");
        int tamanho = Math.max(1, Math.min(limite, LIMITE_MAXIMO));
        List<RegistroAuditoria> lista = service.buscar(usuario, periodo, busca, antesDe, tamanho + 1);
        boolean temMais = lista.size() > tamanho;
        return new Pagina(temMais ? lista.subList(0, tamanho) : lista, temMais);
    }

    @GetMapping("/usuarios")
    public List<String> usuarios(Authentication auth) {
        acessos.exigir(usuarioAtual.de(auth), "auditoria");
        return service.usuarios();
    }
}

package br.com.pocarsport.api.loja;

import static br.com.pocarsport.api.loja.Regras.r2;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import br.com.pocarsport.api.auditoria.AuditoriaService;

/** Cadastro de clientes. */
@Service
public class ClienteService {

    private final Banco db;
    private final AuditoriaService auditoria;

    public ClienteService(Banco db, AuditoriaService auditoria) {
        this.db = db;
        this.auditoria = auditoria;
    }

    @Transactional
    public long salvar(Long id, Pedidos.Cliente p, Contexto ctx) {
        String nome = CatalogoService.limpo(p.nome());
        String sobrenome = CatalogoService.limpo(p.sobrenome());
        String telefone = p.telefone() == null ? "" : p.telefone().replaceAll("\\D", "");
        if (nome.length() < 2) {
            throw new RegraException("Informe o nome.");
        }
        if (sobrenome.length() < 2) {
            throw new RegraException("Informe o sobrenome.");
        }
        if (telefone.length() < 10 || telefone.length() > 11) {
            throw new RegraException("Informe o telefone com DDD (10 ou 11 dígitos).");
        }
        if (telefone.length() == 11 && telefone.charAt(2) != '9') {
            throw new RegraException("Celular com 11 dígitos começa com 9 depois do DDD.");
        }
        Optional<Map<String, Object>> dono = db.um("select id, nome, sobrenome from cliente where telefone = ?", telefone);
        if (dono.isPresent() && !Long.valueOf(Banco.id(dono.get(), "id")).equals(id)) {
            throw new RegraException("Este telefone já é de " + Banco.txt(dono.get(), "nome") + " " + Banco.txt(dono.get(), "sobrenome") + ".");
        }
        LocalDate nascimento = p.nascimento();
        if (nascimento == null) {
            throw new RegraException("Informe a data de nascimento.");
        }
        if (nascimento.isAfter(ctx.hoje())) {
            throw new RegraException("A data de nascimento não pode estar no futuro.");
        }
        if (Period.between(nascimento, ctx.hoje()).getYears() > 110) {
            throw new RegraException("Confira o ano de nascimento.");
        }
        BigDecimal limite = p.limite() == null ? null : r2(p.limite());
        if (limite != null && limite.signum() < 0) {
            throw new RegraException("O limite do crediário não pode ser negativo.");
        }
        String nomeCompleto = nome + " " + sobrenome;
        if (id == null) {
            long novo = db.inserir("insert into cliente (nome, sobrenome, telefone, nascimento, limite_credito, criado_em) values (?, ?, ?, ?, ?, ?)",
                nome, sobrenome, telefone, nascimento, limite, ctx.hoje());
            auditoria.registrar(ctx.usuario(), "Cliente cadastrado", nomeCompleto, null);
            return novo;
        }
        int alterados = db.executar("update cliente set nome = ?, sobrenome = ?, telefone = ?, nascimento = ?, limite_credito = ? where id = ?",
            nome, sobrenome, telefone, nascimento, limite, id);
        if (alterados == 0) {
            throw new RegraException("Cliente não encontrado.");
        }
        auditoria.registrar(ctx.usuario(), "Cadastro de cliente alterado", nomeCompleto, null);
        return id;
    }

    String nomeCompleto(Long id) {
        if (id == null) {
            return "";
        }
        return db.um("select nome || ' ' || sobrenome as nome from cliente where id = ?", id).map(c -> Banco.txt(c, "nome")).orElse("");
    }
}

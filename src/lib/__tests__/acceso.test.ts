import { describe, it, expect, beforeAll } from "vitest";
import { cifrarClave, claveCorrecta, problemaDeClave, claveTemporal } from "../auth/clave";
import { firmar, leer } from "../auth/cookie";
import { puede } from "../auth/permisos";
import { destinoSeguro } from "../auth/destino";

describe("claves", () => {
  it("la correcta pasa y otra no", async () => {
    const h = await cifrarClave("Licitaciones2026x");
    expect(await claveCorrecta("Licitaciones2026x", h)).toBe(true);
    expect(await claveCorrecta("licitaciones2026x", h)).toBe(false);
  });
  it("la misma clave da hashes distintos (sal)", async () => expect(await cifrarClave("Abcdefghij1")).not.toBe(await cifrarClave("Abcdefghij1")));
  it("un hash dañado no pasa", async () => expect(await claveCorrecta("x", "basura")).toBe(false));
  it("exige 10 caracteres con letras y números", () => {
    expect(problemaDeClave("corta1")).toMatch(/10/);
    expect(problemaDeClave("soloLetrasLargas")).toMatch(/números/);
    expect(problemaDeClave("Conconcreto2026")).toBeNull();
  });
  it("la temporal tiene el formato xxxx-xxxxx-xxxxx y cumple la regla", () => {
    const c = claveTemporal();
    expect(c).toMatch(/^.{4}-.{5}-.{5}$/);
  });
});

describe("cookie firmada", () => {
  beforeAll(() => { process.env.SESION_SECRETO = "s".repeat(48); });
  it("se lee lo que se firmó", async () => {
    const t = await firmar({ sid: "s1", uid: "u1", rol: "admin" }, new Date(Date.now() + 60_000));
    expect(await leer(t)).toEqual({ sid: "s1", uid: "u1", rol: "admin" });
  });
  it("una alterada no se acepta", async () => {
    const t = await firmar({ sid: "s1", uid: "u1", rol: "consulta" }, new Date(Date.now() + 60_000));
    const [h, , f] = t.split(".");
    const otra = Buffer.from(JSON.stringify({ sid: "s1", uid: "u1", rol: "admin", exp: 9999999999 })).toString("base64url");
    expect(await leer(`${h}.${otra}.${f}`)).toBeNull();
  });
  it("una vencida no se acepta", async () => expect(await leer(await firmar({ sid: "s", uid: "u", rol: "admin" }, new Date(Date.now() - 1000)))).toBeNull());
  it("una firmada con otro secreto no se acepta", async () => {
    const t = await firmar({ sid: "s", uid: "u", rol: "admin" }, new Date(Date.now() + 60_000));
    process.env.SESION_SECRETO = "o".repeat(48);
    expect(await leer(t)).toBeNull();
    process.env.SESION_SECRETO = "s".repeat(48);
  });
});

describe("permisos", () => {
  it("solo el administrador maneja personas y accesos", () => {
    for (const p of ["usuarios.administrar", "accesos.administrar", "apps.editar"] as const) { expect(puede("admin", p)).toBe(true); expect(puede("miembro", p)).toBe(false); }
  });
  it("un miembro ve", () => expect(puede("miembro", "ver")).toBe(true));
  it("sin rol, nada", () => expect(puede(null, "ver")).toBe(false));
});

describe("a dónde volver después de ingresar", () => {
  it("una ruta interna se respeta", () => expect(destinoSeguro("/oportunidades/abc?x=1")).toBe("/oportunidades/abc?x=1"));
  it("otro sitio no", () => { expect(destinoSeguro("//evil.com")).toBe("/"); expect(destinoSeguro("https://evil.com")).toBe("/"); expect(destinoSeguro(String.raw`/\evil.com`)).toBe("/"); });
  it("vacío o el mismo ingreso, al inicio", () => { expect(destinoSeguro("")).toBe("/"); expect(destinoSeguro("/ingresar")).toBe("/"); });
});

import { porSemana } from "../github";
describe("cambios por semana", () => {
  const ahora = new Date("2026-11-08T12:00:00Z");
  it("cuenta en la semana que toca, la más reciente al final", () => {
    expect(porSemana(["2026-11-08T10:00:00Z", "2026-11-03T10:00:00Z", "2026-10-30T10:00:00Z"], ahora, 4)).toEqual([0, 0, 1, 2]);
  });
  it("lo de antes de la ventana o del futuro no cuenta", () => expect(porSemana(["2026-01-01T00:00:00Z", "2026-12-01T00:00:00Z"], ahora, 4)).toEqual([0, 0, 0, 0]));
});

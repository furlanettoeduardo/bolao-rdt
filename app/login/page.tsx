import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm pt-6 md:pt-12">
      <h1 className="mb-1 text-center text-2xl font-bold text-field-900">
        Entrar
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Acesse sua conta para registrar seus palpites.
      </p>

      <Card>
        <CardBody className="py-5">
          <LoginForm />
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-600">
        Ainda não tem conta?{" "}
        <Link
          href="/cadastro"
          className="font-semibold text-field-700 hover:underline"
        >
          Cadastre-se
        </Link>
      </p>

      <p className="mt-2 text-center text-xs">
        <Link href="/regras" className="text-slate-400 hover:underline">
          Como funciona o bolão? Veja as regras
        </Link>
      </p>
    </div>
  );
}

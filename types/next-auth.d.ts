import type { DefaultSession } from "next-auth";
// Importa o submódulo para que a augmentação de "next-auth/jwt" seja aplicada
import "next-auth/jwt";
import type { Role } from "@/lib/types";

declare module "next-auth" {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}

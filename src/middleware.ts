export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

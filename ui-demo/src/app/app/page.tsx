import { redirect } from "next/navigation";

/** Mở app lần đầu → hướng dẫn (F18) */
export default function AppHome() {
  redirect("/app/huong-dan");
}

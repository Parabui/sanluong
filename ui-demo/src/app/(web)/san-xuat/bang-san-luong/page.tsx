import type { Metadata } from "next";
import { Suspense } from "react";
import { DailyBoard } from "./daily-board";

export const metadata: Metadata = { title: "Bảng sản lượng ngày" };

export default function Page() {
  return (
    <Suspense>
      <DailyBoard />
    </Suspense>
  );
}

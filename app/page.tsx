import { Suspense } from "react";

import HomeClient from "@/app/components/HomeClient";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}

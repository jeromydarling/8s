import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Rowel } from "./components/ui";

const Home = lazy(() => import("./marketing/Home"));
const DemoApp = lazy(() => import("./app/DemoApp"));
const SubmitEvent = lazy(() => import("./marketing/SubmitEvent"));
const AuthPages = lazy(() => import("./marketing/AuthPages").then((m) => ({ default: m.VerifyPage })));
const ResetPage = lazy(() => import("./marketing/AuthPages").then((m) => ({ default: m.ResetPage })));
const ForgotPage = lazy(() => import("./marketing/AuthPages").then((m) => ({ default: m.ForgotPage })));

function Loader() {
  return (
    <div className="grid min-h-screen place-items-center bg-bone">
      <Rowel className="h-10 w-10 animate-spin text-rust [animation-duration:1.4s]" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<SubmitEvent />} />
        <Route path="/verify" element={<AuthPages />} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/app/*" element={<DemoApp />} />
      </Routes>
    </Suspense>
  );
}

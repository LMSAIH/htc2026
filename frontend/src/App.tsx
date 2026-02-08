import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PublicLayout } from "@/components/layout/public-layout";
import { AppLayout } from "@/components/layout/app-layout";
import HomePage from "@/pages/home";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import MissionsPage from "@/pages/missions";
import MissionDetailPage from "@/pages/mission-detail";
import MyMissionsPage from "@/pages/my-missions";
import LeaderboardPage from "@/pages/leaderboard";
import CreateMissionPage from "@/pages/create-mission";
import AnnotatePage from "@/pages/annotate";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* App routes (behind auth) */}
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<MissionsPage />} />
          <Route path="missions/new" element={<CreateMissionPage />} />
          <Route path="missions/:id" element={<MissionDetailPage />} />
          <Route path="missions/:id/annotate" element={<AnnotatePage />} />
          <Route path="my-missions" element={<MyMissionsPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

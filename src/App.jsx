import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import MapPage from "./pages/MapPageDev";
import ReviewPage from "./pages/ReviewPage";
import "./index.css"; 

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <aside className="sidebar">
          <h2>Mapping LIA</h2>
          <nav>
            <NavLink to="/map">Map competences</NavLink>
            <NavLink to="/review">Review competences</NavLink>
          </nav>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/map" element={<MapPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="*" element={<ReviewPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

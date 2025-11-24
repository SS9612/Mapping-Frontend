import { useState } from "react";
import { mapSingle, mapLines } from "../api/areaMapperApi";

export default function MapPage() {
  const [input, setInput] = useState("");
  const [multiInput, setMultiInput] = useState("");
  const [result, setResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSingleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await mapSingle(input);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleMultiSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await mapLines(multiInput);
      setBatchResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page map-page">
      <h1>Map competences</h1>

      <section className="card">
        <h2>Single competence</h2>
        <form onSubmit={handleSingleSubmit}>
          <input
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter competence text..."
          />
          <button className="btn btn-approve" type="submit" disabled={loading}>
            Map
          </button>
        </form>
        {result && <pre className="result">{JSON.stringify(result, null, 2)}</pre>}
      </section>

      <section className="card">
        <h2>Multiple competences (one per line)</h2>
        <form onSubmit={handleMultiSubmit}>
          <textarea
            className="input"
            rows={6}
            value={multiInput}
            onChange={e => setMultiInput(e.target.value)}
          />
          <button className="btn btn-approve" type="submit" disabled={loading}>
            Map lines
          </button>
        </form>
        {batchResult && <pre className="result">{JSON.stringify(batchResult, null, 2)}</pre>}
      </section>
    </div>
  );
}

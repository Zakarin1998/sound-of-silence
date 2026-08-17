import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, Moon } from 'lucide-react';
import { NoiseMesh } from './NoiseMesh';

export default function App() {
  const [isQuiet, setIsQuiet] = useState(false);
  const [latency, setLatency] = useState(42);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLatency(isQuiet ? 4 : Math.floor(38 + Math.random() * 12));
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isQuiet]);

  return (
    <div className="app-shell">
      <div className={`ambient-glow ${isQuiet ? 'ambient-glow--quiet' : ''}`} />

      <div className="scene" aria-hidden="true">
        <Canvas camera={{ position: [0, 0, 7], fov: 60 }}>
          <ambientLight intensity={0.5} />
          <NoiseMesh active={!isQuiet} />
        </Canvas>
      </div>

      <header className="hud header-hud">
        <span className="brand"><BrainCircuit size={14} /> SYSTEM_SILENCE</span>
        <span>MODE: {isQuiet ? 'REST' : 'ACTIVE_STRUCTURE'}</span>
      </header>

      <main className="center-stage">
        <AnimatePresence mode="wait">
          {!isQuiet ? (
            <motion.section
              key="structure"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.6 }}
              className="panel"
            >
              <p className="eyebrow">cognitive loop detected</p>
              <h1>THE STRUCTURE IS THE NOISE.</h1>
              <button onClick={() => setIsQuiet(true)}>[ ENTER THE QUIET ]</button>
            </motion.section>
          ) : (
            <motion.section
              key="quiet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="panel panel--quiet"
            >
              <Moon className="panel-icon" size={32} />
              <p>Nothing to solve right now.</p>
              <button className="link-button" onClick={() => setIsQuiet(false)}>
                return to structure
              </button>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="hud footer-hud">
        <div>PROCESSING_LATENCY: {latency}ms | SIGNAL_STRENGTH: {isQuiet ? 'MUTED' : 'NOMINAL'}</div>
        <div className="depth-meter" aria-label="Depth meter">
          <div className="depth-track"><span style={{ height: isQuiet ? '10%' : '80%' }} /></div>
          <span>DEPTH</span>
        </div>
      </footer>
    </div>
  );
}

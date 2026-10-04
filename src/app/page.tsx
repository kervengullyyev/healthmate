'use client';
import { useEffect, useReducer, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Home } from '@/components/home';
import { createSession, sessionReducer } from '@/lib/session';
export default function Page() {
  const [state, dispatch] = useReducer(sessionReducer, 'live', createSession); const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/status').then(r => r.json()).then(data => setConfigured(data.liveConfigured)).catch(() => setConfigured(false)); }, []);
  function start(mode: 'live' | 'demo') { dispatch({ type: 'reset', mode }); dispatch({ type: 'screen', screen: 'conversation' }); }
  return <AppShell screen={state.screen} mode={state.mode} hasPlan={Boolean(state.plan)} onNavigate={screen => dispatch({ type: 'screen', screen })} onReset={() => dispatch({ type: 'reset', mode: 'live' })}>{state.screen === 'home' ? <Home onStartVoice={() => start('live')} onStartText={() => start('live')} onStartDemo={() => start('demo')} liveConfigured={configured} /> : <div className="page-intro"><h1>Your conversation</h1></div>}</AppShell>;
}

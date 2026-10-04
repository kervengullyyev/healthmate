import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'HealthMate — a little clarity, a little care', description: 'Your AI health companion. Talk it through, find your next step, and prepare for care.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }

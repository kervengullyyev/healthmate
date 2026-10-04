import type { Booking, CarePlan, Message, Mode, Screen } from './domain';
export type SessionState = { mode: Mode; screen: Screen; messages: Message[]; plan: CarePlan | null; brief: string; briefEdited: boolean; booking: Booking | null; demoStep: number };
export type SessionAction = { type: 'reset'; mode: Mode } | { type: 'screen'; screen: Screen } | { type: 'message'; message: Message } | { type: 'transcript'; messages: Message[] } | { type: 'plan'; plan: CarePlan } | { type: 'brief'; text: string } | { type: 'replace-brief' } | { type: 'concern'; text: string } | { type: 'booking'; booking: Booking } | { type: 'demo-step'; step: number };
export function createSession(mode: Mode): SessionState { return { mode, screen: 'home', messages: [], plan: null, brief: '', briefEdited: false, booking: null, demoStep: 0 }; }
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'reset': return createSession(action.mode);
    case 'screen': return { ...state, screen: action.screen };
    case 'message': return { ...state, messages: [...state.messages, action.message] };
    case 'transcript': return { ...state, messages: action.messages };
    case 'plan': return { ...state, plan: action.plan, brief: state.briefEdited ? state.brief : action.plan.doctorBrief };
    case 'brief': return { ...state, brief: action.text, briefEdited: true };
    case 'replace-brief': return { ...state, brief: state.plan?.doctorBrief ?? '', briefEdited: false };
    case 'concern': return { ...state, plan: state.plan ? { ...state.plan, concern: action.text } : null };
    case 'booking': return state.mode === 'demo' ? { ...state, booking: action.booking } : { ...state, booking: action.booking };
    case 'demo-step': return { ...state, demoStep: action.step };
  }
}

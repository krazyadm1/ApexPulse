import { LegendInfo } from './types';

export const LEGENDS: Record<string, LegendInfo> = {
  'bangalore': {
    id: 'bangalore',
    displayName: 'Bangalore',
    class: 'Assault',
    tactical: 'Smoke Launcher',
    ultimate: 'Rolling Thunder',
    passive: 'Double Time'
  },
  'bloodhound': {
    id: 'bloodhound',
    displayName: 'Bloodhound',
    class: 'Recon',
    tactical: 'Eye of the Allfather',
    ultimate: 'Beast of the Hunt',
    passive: 'Tracker'
  },
  'gibraltar': {
    id: 'gibraltar',
    displayName: 'Gibraltar',
    class: 'Support',
    tactical: 'Dome of Protection',
    ultimate: 'Defensive Bombardment',
    passive: 'Gun Shield'
  },
  'lifeline': {
    id: 'lifeline',
    displayName: 'Lifeline',
    class: 'Support',
    tactical: 'D.O.C. Heal Drone',
    ultimate: 'Care Package',
    passive: 'Combat Medic'
  },
  'pathfinder': {
    id: 'pathfinder',
    displayName: 'Pathfinder',
    class: 'Skirmisher',
    tactical: 'Grappling Hook',
    ultimate: 'Zipline Gun',
    passive: 'Insider Knowledge'
  },
  'wraith': {
    id: 'wraith',
    displayName: 'Wraith',
    class: 'Skirmisher',
    tactical: 'Into the Void',
    ultimate: 'Dimensional Rift',
    passive: 'Voices from the Void'
  },
  // Add more legends as needed
};

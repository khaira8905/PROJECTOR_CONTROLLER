import { cn } from '../../lib/cn';

const dotColor: Record<string, string> = {
  'please-wait': 'bg-sky-400',
  technical: 'bg-orange-400',
  break: 'bg-teal-400',
  starting: 'bg-cyan-400',
  'coming-up': 'bg-indigo-400',
  thanks: 'bg-fuchsia-400',
  custom: 'bg-slate-400',
};

/** The colour that identifies a special screen style throughout the console. */
export function ScreenDot({ style }: { style: string }) {
  return <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotColor[style] ?? dotColor.custom)} />;
}

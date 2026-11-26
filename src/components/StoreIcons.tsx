import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };
function Icon({ size = 20, children, ...props }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
export function SearchIcon(props: IconProps) { return <Icon {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></Icon>; }
export function CloseIcon(props: IconProps) { return <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>; }
export function GridIcon(props: IconProps) { return <Icon {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Icon>; }
export function ChevronIcon({ className = "", ...props }: IconProps) { return <Icon className={className} {...props}><path d="m9 5 7 7-7 7" /></Icon>; }
export function CheckIcon(props: IconProps) { return <Icon {...props}><path d="m5 12 4 4 10-10" /></Icon>; }
export function PackageIcon(props: IconProps) { return <Icon {...props}><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5" /></Icon>; }
export function CategoryIcon({ category, ...props }: IconProps & { category: string }) {
  switch (category) {
    case "AGRI_MACHINERY": return <Icon {...props}><circle cx="8" cy="17" r="4" /><circle cx="19" cy="18" r="2.5" /><path d="M12 17h4.5M3 11h10l3 6M7 11V6h5l2 5M19 15.5V10h-3" /></Icon>;
    case "FARM_EQUIPMENT": return <Icon {...props}><path d="M3 21V10l9-7 9 7v11H3Z" /><path d="M9 21v-8h6v8M3 10h18M9 7h6" /></Icon>;
    case "SPRAYING_IRRIGATION": return <Icon {...props}><path d="M12 3s-7 7.5-7 12a7 7 0 0 0 14 0c0-4.5-7-12-7-12Z" /><path d="M8 15a4 4 0 0 0 4 4" /></Icon>;
    case "GARDEN_FORESTRY": return <Icon {...props}><path d="m12 2-6 8h3l-5 7h6v5h4v-5h6l-5-7h3l-6-8Z" /></Icon>;
    case "ATV_TRANSPORT": return <Icon {...props}><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M4 15V9h13l3 6M9 9l2-4h5M9 18h6M3 12h17" /></Icon>;
    case "TIRES_WHEELS": return <Icon {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /><path d="m12 3 2 2M19 6v3M21 12l-2 2M18 19h-3M12 21l-2-2M5 18v-3M3 12l2-2M6 5h3" /></Icon>;
    case "SPARE_PARTS_ACCESSORIES": return <Icon {...props}><path d="m9 3 1 3h4l1-3 3 2-1 3 2 3 3 1-1 4h-3l-2 3v3h-4l-1-3-3-1-3 1-2-3 2-2v-4L2 8l2-3 3 1 2-3Z" /><circle cx="12" cy="12" r="3" /></Icon>;
    case "WORKSHOP_CONSTRUCTION": return <Icon {...props}><path d="m14 6 4-4 4 4-4 4M14 6l4 4-6 6-4-4 6-6ZM8 12l4 4-7 7-4-4 7-7ZM3 3l5 5M2 2l3 1-2 2-1-3Z" /></Icon>;
    default: return <GridIcon {...props} />;
  }
}

export interface AnnouncementLink {
  label: string;
  href: string;
}

export interface AnnouncementItem {
  title: string;
  description: string | null;
  link: AnnouncementLink | null;
}

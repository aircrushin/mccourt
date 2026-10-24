import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'McCourt 麦门法庭',
  description: '吃什么吵不明白？交给麦门大法官。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

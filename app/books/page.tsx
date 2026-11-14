'use client';

import BookSelector from '@/components/BookSelector';
import { useDistrict } from '@/lib/useDistrict';

export default function BooksPage() {
  const { withDistrict } = useDistrict();
  return <BookSelector homeHref={withDistrict('/')} />;
}

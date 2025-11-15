import { requireAuth } from '@/lib/auth-utils';
import React from 'react'

const page = async() => {
    await requireAuth();

  return (
    <div>page</div>
  )
}

export default page
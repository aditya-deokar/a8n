import RegisterForm from '@/features/auth/components/register-form'
import { requireUnauth } from '@/lib/auth-utils';
import Image from 'next/image';
import Link from 'next/link';


const page = async() => {
    // await requireUnauth();
  return (
    

          <RegisterForm/>
   
  )
}

export default page
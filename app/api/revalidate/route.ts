import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    // Utilizamos el SERVICE_ROLE_KEY o un secreto específico como contraseña
    const expectedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REVALIDATE_SECRET;

    if (!secret || secret !== expectedSecret) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

    // Purgar la caché de la home y la caché de los detalles
    revalidatePath('/');
    revalidatePath('/release/[id]', 'page');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}

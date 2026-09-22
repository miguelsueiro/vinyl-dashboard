import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    // Secreto dedicado. NO reutilizar la service role key: viajaría por la red
    // en cada llamada y da acceso total de escritura a la base de datos.
    const expectedSecret = process.env.REVALIDATE_SECRET;

    if (!expectedSecret) {
      console.error("REVALIDATE_SECRET no está configurado: se rechaza la petición.");
      return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
    }

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

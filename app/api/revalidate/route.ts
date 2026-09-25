import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { ETIQUETA_CATALOGO } from '@/lib/datos';

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
    // Y la lectura compartida del catálogo, que es la que de verdad guarda los
    // discos y los precios: sin esto las páginas se volverían a construir con
    // los datos de antes de la sincronización.
    // expire: 0 y no un perfil con margen: quien entre después de la
    // sincronización tiene que ver los precios nuevos, no los de ayer con un
    // refresco en segundo plano. La pasada termina de madrugada, así que la
    // petición que paga la relectura no la hace nadie mirando la pantalla.
    revalidateTag(ETIQUETA_CATALOGO, { expire: 0 });

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch {
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}

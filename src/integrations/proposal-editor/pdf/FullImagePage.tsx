import { Page, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * Página A4 que renderiza uma imagem ocupando 100% da página, sem margens nem
 * sobreposição. Usada para Capa/Sobre/Clientes quando o template tem uma arte
 * completa enviada pelo usuário.
 */
export function FullImagePage({ src }: { src: string }) {
  return (
    <Page size="A4" style={styles.page}>
      <Image src={src} style={styles.image} />
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { padding: 0, margin: 0 },
  image: { width: "100%", height: "100%", objectFit: "cover" },
});

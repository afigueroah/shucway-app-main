declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'swiper/css' {
  const styles: Record<string, string>;
  export default styles;
}

declare module 'swiper/css/navigation' {
  const styles: Record<string, string>;
  export default styles;
}

declare module 'swiper/css/pagination' {
  const styles: Record<string, string>;
  export default styles;
}

declare module 'swiper/css/effect-fade' {
  const styles: Record<string, string>;
  export default styles;
}

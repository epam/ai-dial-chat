import Document, {
  DocumentContext,
  DocumentInitialProps,
  DocumentProps,
} from 'next/document';
import { ComponentType } from 'react';
import { JssProvider, SheetsRegistry, createGenerateId } from 'react-jss';

const SERVER_SIDE_JSS_STYLES_ID = 'server-side-jss-styles';

type DocumentWithInitialProps = ComponentType<DocumentProps> & {
  getInitialProps?: (ctx: DocumentContext) => Promise<DocumentInitialProps>;
};

export function documentWithJss(DocumentComponent: DocumentWithInitialProps) {
  DocumentComponent.getInitialProps = async (
    ctx: DocumentContext,
  ): Promise<DocumentInitialProps> => {
    const registry = new SheetsRegistry();
    const generateId = createGenerateId();
    const originalRenderPage = ctx.renderPage;

    ctx.renderPage = () =>
      originalRenderPage({
        enhanceApp: (App) => (props) => (
          <JssProvider registry={registry} generateId={generateId}>
            <App {...props} />
          </JssProvider>
        ),
      });

    const initialProps = await Document.getInitialProps(ctx);
    const styles = registry.toString();

    return {
      ...initialProps,
      styles: (
        <>
          {initialProps.styles}
          <style
            id={SERVER_SIDE_JSS_STYLES_ID}
            // use dangerouslySetInnerHTML to avoid escaping
            dangerouslySetInnerHTML={{ __html: styles }}
          />
        </>
      ),
    };
  };

  return DocumentComponent;
}

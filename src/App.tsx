import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { RouterProvider, type RouterProviderProps } from "react-router";

export function App({
  router,
  queryClient,
}: {
  router: RouterProviderProps["router"];
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

import { ErrorPage } from "@/components/ErrorPage";

export default function NotFound() {
  return (
    <ErrorPage
      title="페이지를 찾을 수 없습니다."
      message="요청한 페이지가 없거나 이미 삭제되었습니다."
    />
  );
}

import { redirect } from "next/navigation";

interface TourstarPostRedirectPageProps {
  params: {
    postId: string;
  };
}

export default function TourstarPostRedirectPage({ params }: TourstarPostRedirectPageProps) {
  const postId = params.postId;
  redirect(`/tourstar?postId=${encodeURIComponent(postId)}`);
}

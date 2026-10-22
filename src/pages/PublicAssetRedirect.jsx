import React from "react";
import { Navigate, useParams } from "react-router-dom";

// Las etiquetas QR viejas apuntaban a /public/asset/:id.
export default function PublicAssetRedirect() {
  const { id } = useParams();
  return <Navigate to={`/scan/asset/${id}`} replace />;
}
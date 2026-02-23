module WorksHelper
  # Generates an imgproxy thumbnail URL for a work, preserving its natural aspect ratio.
  # Uses `fit` resizing so no cropping occurs — important for masonry layouts.
  # Omitting height lets imgproxy calculate it proportionally.
  #
  # @param work [Work]
  # @param width [Integer] max thumbnail width in pixels (default 600 for 2× HiDPI at 300 CSS px)
  # @return [String] signed imgproxy URL
  def thumbnail_url(work, width: 600)
    Imgproxy.url_for(
      work.slug,
      width: width,
      resizing_type: :fit,
      gravity: :sm,
      format: :avif
    )
  end

  def thumbnail_dimensions(work, width: 600)
    source_width = work.width.to_f
    source_height = work.height.to_f
    return [width, width] if source_width <= 0 || source_height <= 0

    [width, (width * source_height / source_width).round]
  end
end

class WorksController < ApplicationController
  def index
    @pagy, works = pagy(Work.all, limit: 1)
    @work = works.first
    @max_page = @pagy.pages

    respond_to do |format|
      format.html
      format.json do
        render json: {
          slug: @work.slug,
          title: @work.slug.humanize.split.map(&:capitalize).join(" "),
          imgproxy_url: @work.imgproxy_url,
          location: @work.location,
          year: @work.year,
          description: @work.description,
          dimensions: @work.dimensions.present? ? "#{@work.height} x #{@work.width} #{@work.depth} cm" : nil,
          permalink: work_path(@work.slug),
          page: @pagy.page,
          max_page: @max_page
        }
      end
    end
  end

  def show
    @work = Work.find_by!(slug: params[:slug])
    @max_page = Work.count
  end
end
